import { useEffect, useState } from "react"
import { Button } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import type { useSupportCommand } from "../../hooks/useSupportCommand"
import { getAuthenticatedActor } from "../../services/authApi"
import {
  getReservationPayment,
  listCustomerFacilities,
  listCustomerReservations,
} from "../../services/customerReservationApi"
import { ApiClientError } from "../../services/apiClient"
import { listRentals } from "../../services/rentalApi"
import { isUuid } from "../../services/renewalOperationsApi"
import type { SupportCreate, SupportTicket } from "../../types/supportApi"
import ApiPager from "../rental-api/ApiPager"
import SupportReadState from "./SupportReadState"
import { supportInputClass } from "./presentation"

type Source = "facility" | "rental" | "reservation" | "unit" | "payment"
type Choice = {
  id: string
  label: string
  facilityId: string
}
async function loadChoices(
  source: Source,
  page: number,
  parent?: SupportTicket,
) {
  if (source === "facility") {
    const p = await listCustomerFacilities(page, 20)
    return {
      data: p.data
        .filter(
          (f) =>
            f.status === "active" && (!parent || f.id === parent.facilityId),
        )
        .map((f) => ({
          id: f.id,
          label: `${f.name} · ${f.code}`,
          facilityId: f.id,
        })),
      pagination: {
        page: p.pagination.page,
        pageSize: p.pagination.size,
        totalItems: p.pagination.totalElements,
        totalPages: p.pagination.totalPages,
        sort: "",
      },
    }
  }
  if (source === "reservation" || source === "payment") {
    const p = await listCustomerReservations(undefined, page, 20)
    return {
      data: p.data
        .filter((r) => !parent || r.facilityId === parent.facilityId)
        .map((r) => ({
          id: r.id,
          label: `${r.reservationCode} · ${r.id}`,
          facilityId: r.facilityId,
        })),
      pagination: {
        page: p.pagination.page,
        pageSize: p.pagination.size,
        totalItems: p.pagination.totalElements,
        totalPages: p.pagination.totalPages,
        sort: "",
      },
    }
  }
  const p = await listRentals("customer", { page, size: 20 })
  return {
    ...p,
    data: p.data
      .filter((r) => !parent || r.facility.id === parent.facilityId)
      .map((r) => ({
        id: source === "unit" ? r.storageUnit.id : r.id,
        label: `${r.storageUnit.code} · ${r.id}`,
        facilityId: r.facility.id,
      })),
  }
}
export default function SupportCreateForm({
  command,
  parent,
}: {
  command: ReturnType<typeof useSupportCommand>
  parent?: SupportTicket
}) {
  const [subject, setSubject] = useState(""),
    [description, setDescription] = useState("")
  const [source, setSource] = useState<Source>("facility"),
    [page, setPage] = useState(0)
  const [choice, setChoice] = useState<Choice>()
  const [paymentId, setPaymentId] = useState<string>()
  const actor = getAuthenticatedActor()
  const read = useRentalApiResource(
    `${actor?.id}:support-create:${source}:${page}:${parent?.id}`,
    () => loadChoices(source, page, parent),
  )
  const options =
    read.data?.data.filter((r) => isUuid(r.id) && isUuid(r.facilityId)) ?? []
  const unique = [...new Map(options.map((r) => [r.id, r])).values()]
  const valid =
    !!subject.trim() &&
    subject.length <= 200 &&
    !!description.trim() &&
    description.length <= 4000 &&
    (!!choice || (!!parent && source === "facility")) &&
    (source !== "payment" || !!paymentId)
  const submit = () => {
    if (!valid) return
    const body: SupportCreate = {
      subject: subject.trim(),
      description: description.trim(),
    }
    if (choice && source === "facility") body.facilityId = choice.facilityId
    else if (choice)
      body.linkedRecord = {
        type:
          source === "rental"
            ? "RENTAL"
            : source === "unit"
              ? "STORAGE_UNIT"
              : source === "payment"
                ? "PAYMENT"
                : "RESERVATION",
        id: source === "payment" ? paymentId! : choice.id,
      }
    void command.run({ kind: "create", body, parentId: parent?.id })
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {parent && (
        <p className="break-all rounded bg-stone-50 p-3 text-sm">
          Yêu cầu tiếp nối: {parent.id} · Cơ sở {parent.facilityId}. Không sao
          chép trao đổi hoặc file nội bộ.
        </p>
      )}
      <label className="block text-sm">
        Tiêu đề
        <input
          className={supportInputClass}
          maxLength={200}
          required
          disabled={command.locked}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Nội dung
        <textarea
          className={supportInputClass}
          rows={4}
          maxLength={4000}
          required
          disabled={command.locked}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Liên kết dữ liệu thật
        <select
          className={supportInputClass}
          disabled={command.locked}
          value={source}
          onChange={(e) => {
            setSource(e.target.value as Source)
            setPage(0)
            setChoice(undefined)
            setPaymentId(undefined)
          }}
        >
          <option value="facility">Không liên kết — chọn cơ sở</option>
          <option value="rental">Hồ sơ thuê của tôi</option>
          <option value="reservation">Đặt chỗ của tôi</option>
          <option value="unit">Gian kho theo hồ sơ thuê của tôi</option>
          <option value="payment">Giao dịch theo đặt chỗ của tôi</option>
        </select>
      </label>
      <SupportReadState {...read} retry={read.refresh} />
      {read.data && (
        <div className="space-y-2">
          <label className="block text-sm">
            {source === "facility" ? "Cơ sở đang hoạt động" : "Hồ sơ cụ thể"}
            <select
              className={supportInputClass}
              disabled={command.locked}
              value={choice?.id ?? ""}
              onChange={(e) => {
                setChoice(unique.find((r) => r.id === e.target.value))
                setPaymentId(undefined)
              }}
            >
              <option value="">
                {parent && source === "facility"
                  ? "Dùng cơ sở của yêu cầu gốc"
                  : "Chọn dữ liệu có sẵn"}
              </option>
              {choice && !unique.some((o) => o.id === choice.id) && (
                <option value={choice.id}>{choice.label}</option>
              )}
              {unique.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <ApiPager
            pagination={read.data.pagination}
            onPage={setPage}
            disabled={command.locked}
          />
          {unique.length === 0 && (
            <p className="text-sm text-stone-500">
              Trang này không có dữ liệu phù hợp. Có thể chuyển trang; không tự
              nhập mã hoặc tạo dữ liệu thay thế.
            </p>
          )}
        </div>
      )}
      {source === "payment" && choice && (
        <PaymentChoice
          key={choice.id}
          reservationId={choice.id}
          onChange={setPaymentId}
        />
      )}
      {parent && (
        <p className="text-xs text-stone-500">
          Tổng số/trang là danh mục của tài khoản từ BE; chỉ hiển thị lựa chọn
          cùng cơ sở yêu cầu gốc trên từng trang.
        </p>
      )}
      <p className="text-sm text-stone-500">
        Không tự chọn priority/SLA. Chỉ liên kết Payment thật theo đặt chỗ đã
        chọn. Upload minh chứng chờ quyền file chung; không nhập mã hoặc URL tùy
        ý. BE kiểm tra lại ownership và suy ra cơ sở.
      </p>
      <Button
        type="submit"
        disabled={
          command.locked ||
          command.conflict ||
          !valid ||
          read.loading ||
          !!read.error
        }
      >
        {parent ? "Tạo yêu cầu tiếp nối" : "Gửi yêu cầu"}
      </Button>
    </form>
  )
}
function PaymentChoice({
  reservationId,
  onChange,
}: {
  reservationId: string
  onChange: (value: string | undefined) => void
}) {
  const read = useRentalApiResource(
    `${getAuthenticatedActor()?.id}:support-payment:${reservationId}`,
    async () => {
      const payment = await getReservationPayment(reservationId)
      if (
        !isUuid(payment?.paymentId) ||
        payment.reservationId !== reservationId
      )
        throw new ApiClientError("Giao dịch không khớp đặt chỗ đã chọn.", {
          code: "INVALID_RESPONSE",
        })
      return payment
    },
  )
  useEffect(() => {
    onChange(read.data?.paymentId)
  }, [read.data?.paymentId, onChange])
  return (
    <div className="rounded border border-stone-200 p-3 text-sm">
      <SupportReadState {...read} retry={read.refresh} />
      {read.data && (
        <>
          <p>Giao dịch được ghi nhận cho đặt chỗ này:</p>
          <p className="break-all">{read.data.paymentId}</p>
          <p>Trạng thái: {read.data.paymentStatus}</p>
        </>
      )}
    </div>
  )
}
