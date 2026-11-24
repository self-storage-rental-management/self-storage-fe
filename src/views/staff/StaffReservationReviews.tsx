import { useEffect, useState } from "react"

import { Badge, Button, Card, Input, SectionHeader, Select } from "../../components/ui"
import StaffPagination from "./StaffPagination"

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
  AWAITING_EMAIL: "Đang xử lý hồ sơ",
  AWAITING_REVIEW: "Chờ duyệt hàng hóa",
  AWAITING_PAYMENT: "Chờ thanh toán cọc",
  PAYMENT_GRACE: "Chờ đối soát thanh toán",
  PAYMENT_REVIEW: "Đang duyệt khiếu nại thanh toán",
  CONFIRMED: "Đã thanh toán · Chờ phân kho",
  UNIT_RESERVED: "Đã phân kho",
  READY_FOR_CHECKIN: "Sẵn sàng nhận kho",
  AWAITING_CUSTOMER_RECEIPT: "Chờ khách xác nhận bàn giao",
  PREPARING: "Khách đang chuẩn bị hàng",
  COMPLETED: "Đã hoàn tất bàn giao",
}

const progressSteps = ["Duyệt hồ sơ", "Thanh toán cọc", "Phân kho", "Nhận kho", "Bàn giao"]

function isOtherGoodsItem(item: ReservationReview["goodsItems"][number]) {
  const category = String(item.category || "").trim().toUpperCase()
  const categoryName = item.categoryName?.trim().toLocaleLowerCase("vi-VN") || ""

  return category === "OTHER" || categoryName === "khác" || categoryName === "hàng hóa khác"
}

function progressIndex(status: ReservationStatus) {
  if (status === "AWAITING_REVIEW" || status === "AWAITING_EMAIL") return 0
  if (["AWAITING_PAYMENT", "PAYMENT_GRACE", "PAYMENT_REVIEW"].includes(status)) return 1
  if (status === "CONFIRMED") return 2
  if (["UNIT_RESERVED", "READY_FOR_CHECKIN"].includes(status)) return 3
  if (["AWAITING_CUSTOMER_RECEIPT", "PREPARING", "COMPLETED"].includes(status)) return 4
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

  const [expandedReviews, setExpandedReviews] = useState<Record<string, boolean>>({})

  const [reviewGroup, setReviewGroup] = useState<"processing" | "completed">("processing")

  const [page, setPage] = useState(0)

  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)

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
        const result = await listStaffReservationReviews(page, 20, reviewGroup === "completed")

        if (!disposed) {
          setRows(result.data)
          setTotalPages(result.pagination.totalPages)
          setTotalItems(result.pagination.totalItems)
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
  }, [page, revision, reviewGroup])

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

      setRows([])
      setReviewGroup("completed")
      setPage(0)

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
        subtitle={`Theo dõi hồ sơ hàng hóa tại: ${Object.values(facilityNames).join(", ") || "cơ sở được phân quyền"}.`}
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
      <div className="flex gap-2" role="group" aria-label="Nhóm hồ sơ duyệt hàng hóa">
        {([['processing', 'Đang xử lí'], ['completed', 'Đã hoàn tất']] as const).map(([value, label]) =>
          <Button key={value} variant={reviewGroup === value ? 'primary' : 'outline'} aria-pressed={reviewGroup === value}
            onClick={() => { setReviewGroup(value); setPage(0); setRows([]) }}>{label}</Button>)}
      </div>
      {loading && <p className="text-sm text-stone-500">Đang tải hồ sơ…</p>}
      {!loading && !rows.length && (
        <Card className="p-8 text-center text-stone-500">
          {reviewGroup === "processing" ? "Chưa có hồ sơ đang xử lí tại cơ sở của bạn." : "Chưa có hồ sơ đã hoàn tất tại cơ sở của bạn."}
        </Card>
      )}
      {rows.map((row) => {
        const hasOtherGoods = row.goodsItems.some(isOtherGoodsItem)
        const expanded = Boolean(expandedReviews[row.reservationId])
        const detailsId = `review-details-${row.reservationId}`

        return (
        <Card
          key={row.reservationId}
          className={`px-4 py-3 ${expanded ? "space-y-4" : ""} ${hasOtherGoods ? "border-violet-200 bg-violet-50/40" : "border-amber-200"}`}
        >
          <div className="flex items-start gap-3">
          <div className="grid min-w-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-stone-900">{row.reservationCode}</p>
                {hasOtherGoods && <Badge variant="info">Hàng hóa khác</Badge>}
                <Badge variant={row.goodsReviewStatus === 'APPROVED' ? 'success' : row.goodsReviewStatus === 'REJECTED' ? 'danger' : 'warning'}>
                  {row.goodsReviewStatus === 'APPROVED' ? 'Đã chấp thuận' : row.goodsReviewStatus === 'REJECTED' ? 'Đã từ chối' : reviewGroup === 'processing' ? 'Đang xử lí' : 'Đã kết thúc xử lí'}
                </Badge>
              </div>
              <h3 className="mt-1 break-words font-semibold">{row.customerEmail}</h3>
              <p className="mt-1 break-words text-xs text-stone-600">Cơ sở: {facilityNames[row.facilityId] || row.facilityId}</p>
            </div>
            <div className="space-y-1 text-xs text-stone-600 lg:text-right">
              <p>Kỳ thuê: <b className="font-medium text-stone-900">{formatStaffDate(row.startDate)} → {formatStaffDate(row.endDate)}</b></p>
              <p>Hạn duyệt: {row.reviewDueAt ? formatStaffDateTime(row.reviewDueAt) : "Chưa xác định"}</p>
              <p>Đóng gói: <b className="font-medium text-stone-900">{row.goodsCondition || "-"}</b></p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0 !gap-1.5 !px-2.5 !py-1.5 text-xs"
            aria-expanded={expanded} aria-controls={detailsId}
            aria-label={`${expanded ? 'Thu gọn' : 'Mở rộng'} chi tiết ${row.reservationCode}`}
            title={expanded ? 'Thu gọn chi tiết' : 'Mở rộng chi tiết'}
            onClick={() => setExpandedReviews(current => ({ ...current, [row.reservationId]: !expanded }))}>
            <svg aria-hidden="true" className="show-icon h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" />{!expanded && <path d="M12 5v14" />}</svg>
            <span>{expanded ? 'Thu gọn' : 'Chi tiết'}</span>
          </Button>
          </div>
          <div id={detailsId} hidden={!expanded} className="space-y-4 border-t border-stone-200 pt-4">
          {row.reservationNotes && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950"><b>Ghi chú của khách:</b> {row.reservationNotes}</p>}
          <div className="divide-y divide-stone-200">
          {row.goodsItems.map((item) => {
            const itemIsOtherGoods = isOtherGoodsItem(item)
            return <div key={item.id} className="grid gap-3 py-3 first:pt-0 last:pb-0 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="min-w-0 space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-stone-900">{item.customGoodsName || item.categoryName || staffGoodsCategoryLabel(item.category)}</p>
                  {itemIsOtherGoods && <span className="rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-xs font-medium text-violet-800">Hàng loại khác</span>}
                </div>
                <p className="break-words text-stone-600">{item.description || "Không có mô tả"}</p>
                <p className="text-xs text-stone-600">Chất liệu: {item.customMaterial || item.materialName || "Không có"} · Dễ vỡ: {item.fragile ? "Có" : "Không"}</p>
              </div>
              <dl className="grid grid-cols-2 content-start gap-x-4 gap-y-2 text-xs">
                <div><dt className="text-stone-500">Số lượng</dt><dd className="mt-0.5 font-semibold text-stone-900">{item.quantity} kiện</dd></div>
                <div><dt className="text-stone-500">Kích thước / kiện</dt><dd className="mt-0.5 font-medium text-stone-900">{item.lengthCm} × {item.widthCm} × {item.heightCm} cm</dd></div>
                <div><dt className="text-stone-500">Khối lượng / kiện</dt><dd className="mt-0.5 font-medium text-stone-900">{item.weightPerItemKg} kg</dd></div>
                <div><dt className="text-stone-500">Tổng khối lượng</dt><dd className="mt-0.5 font-semibold text-stone-900">{(item.quantity * item.weightPerItemKg).toLocaleString("vi-VN")} kg</dd></div>
              </dl>
              {(item.customerNote || item.images?.length > 0) && <div className="min-w-0 space-y-2 md:col-span-2 xl:col-span-1">
                {item.customerNote && <p className="break-words text-xs text-stone-600"><b>Ghi chú:</b> {item.customerNote}</p>}
                {item.images?.length > 0 && <div className="flex flex-wrap gap-2">
                  {item.images.map((image, index) => <Button key={image.id} type="button" size="sm" variant="outline" title={image.originalName} onClick={() => void viewGoodsImage(image.id)}>Xem ảnh {index + 1}</Button>)}
                </div>}
              </div>}
            </div>
          })}
          </div>
          {reviewGroup === "completed" ? <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-stone-200 pt-3 text-xs">
            <Badge variant={row.goodsReviewStatus === 'APPROVED' ? 'success' : row.goodsReviewStatus === 'REJECTED' ? 'danger' : 'info'}>
              {row.goodsReviewStatus === 'APPROVED' ? 'Đã chấp thuận' : row.goodsReviewStatus === 'REJECTED' ? 'Đã từ chối' : 'Đã kết thúc xử lí'}
            </Badge>
            {row.reviewedAt && <p>Thời điểm duyệt: {formatStaffDateTime(row.reviewedAt)}</p>}
            {row.reviewNote && <p className="w-full break-words">Ghi chú duyệt: {row.reviewNote}</p>}
          </div> : <>
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
          </>}
          </div>
        </Card>
        )
      })}
      {totalPages > 1 && (
        <StaffPagination
          page={page + 1}
          pageCount={totalPages}
          total={totalItems}
          onPageChange={(next) => setPage(next - 1)}
        />
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
              <span className="mr-1 font-bold">{index + 1}.</span>{step}
            </div>)}
          </div>
        </Card>
      })}
      {activeTotalPages > 1 && (
        <StaffPagination
          page={activePage + 1}
          pageCount={activeTotalPages}
          total={activeTotalItems}
          onPageChange={(next) => setActivePage(next - 1)}
        />
      )}
    </div>
  )
}
