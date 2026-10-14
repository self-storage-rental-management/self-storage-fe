import { useManagerPresentation } from "../manager/managerPresentation"
import { singleManagerFacility, managerFacilityNotice } from "../manager/managerFacilityUi"
import { useEffect, useRef, useState } from "react"
import { Badge, Button, Card, Modal } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { useSupportCommand } from "../../hooks/useSupportCommand"
import { getAuthenticatedActor, type ApiActor } from "../../services/authApi"
import { listSupportQueue, listSupportTickets } from "../../services/supportApi"
import { supportStatuses } from "../../types/supportApi"
import type {
  SupportQuery,
  SupportRole,
  SupportTicket,
} from "../../types/supportApi"
import ApiPager from "../rental-api/ApiPager"
import { rentalDate } from "../rental-api/presentation"
import SupportCreateForm from "./SupportCreateForm"
import SupportReadState from "./SupportReadState"
import SupportTicketDetail from "./SupportTicketDetail"
import {
  canReadSupport,
  supportError,
  supportInputClass,
  supportStatusLabels,
  supportTicketVisible,
  supportAssigneeLabel,
} from "./presentation"

export default function SupportApiWorkspace({
  role,
  onLocked,
}: {
  role: SupportRole
  onLocked?: (locked: boolean) => void
}) {
  const { manager, copy, errorText } = useManagerPresentation()

  const actor = getAuthenticatedActor()
  if (!canReadSupport(actor, role))
    return (
      <Card className={manager ? "space-y-2 p-5 text-sm leading-relaxed" : "space-y-2 p-5"}>
        <h2 className={manager ? "text-lg font-bold text-stone-900" : "font-semibold"}>Hỗ trợ khách hàng</h2>
        <p role="alert" className={manager ? "break-words text-sm text-stone-700" : undefined}>
          Bạn chưa có quyền truy cập hỗ trợ tại cơ sở này. Vui lòng đăng nhập đúng tài khoản hoặc liên hệ quản lý.</p>
      </Card>
    )
  const identity = `${actor!.id}:${role}:${JSON.stringify(actor!.facilityScopes)}:${JSON.stringify(actor!.permissions)}`
  if (role === "manager" && !singleManagerFacility(actor))
    return <Card className="p-5" role="alert">{managerFacilityNotice(actor)}</Card>
  return (
    <SupportSession
      key={identity}
      actor={actor!}
      role={role}
      identity={identity}
      onLocked={onLocked}
    />
  )
}
function SupportSession({
  actor,
  role,
  identity,
  onLocked,
}: {
  actor: ApiActor
  role: SupportRole
  identity: string
  onLocked?: (locked: boolean) => void
}) {
  const { copy, errorText } = useManagerPresentation()

  const facilityId = role === "manager" ? singleManagerFacility(actor) : undefined
  const [query, setQuery] = useState<SupportQuery>({
    page: 0,
    size: role === "manager" ? 10 : 20,
    facilityId,
    sort: "createdAt,desc",
  })
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string>()
  const [creation, setCreation] = useState<{ parent?: SupportTicket }>()
  const [revision, setRevision] = useState(0)
  const [staffView, setStaffView] = useState<"queue" | "assigned">("queue")
  const [queuePage, setQueuePage] = useState(0)
  const read = useRentalApiResource(
    `${identity}:${JSON.stringify(query)}`,
    () => listSupportTickets(role, query),
  )
  const queueQuery: SupportQuery = { page: queuePage, size: query.size, search: query.search, sort: query.sort }
  const queueRead = useRentalApiResource(
    `${identity}:queue:${JSON.stringify(queueQuery)}`,
    () => role === "staff" ? listSupportQueue(queueQuery) : Promise.resolve({
      data: [], pagination: { page: 0, pageSize: 20, totalItems: 0, totalPages: 0, sort: "createdAt,desc" }, correlationId: null,
    }),
  )
  const command = useSupportCommand(`${actor.id}:support:${role}`, () => {
    read.refresh()
    queueRead.refresh()
    setRevision((n) => n + 1)
    setCreation(undefined)
  })
  const [uploading, setUploading] = useState(false)
  const uploadLock = useRef(false)
  const uploadBusy = (busy: boolean) => {
    uploadLock.current = busy
    setUploading(busy)
    if (busy) onLocked?.(true)
  }
  const locked = command.locked || uploading
  const formCommand = { ...command, locked }
  useEffect(() => {
    onLocked?.(locked)
    return () => onLocked?.(false)
  }, [locked, onLocked])
  const reload = () => {
    if (command.locked || uploadLock.current) return
    command.clearError()
    read.refresh()
    queueRead.refresh()
    setRevision((n) => n + 1)
  }
  const change = (patch: SupportQuery) => {
    if (command.locked || uploadLock.current) return
    setQuery((q) => ({ ...q, ...patch, page: 0 }))
    setQueuePage(0)
    setSelected(undefined)
  }
  const commandNotice = (
    <>
      {uploading && <p role="status" className="text-sm">Đang lưu tệp. Vui lòng chờ trước khi đóng biểu mẫu.</p>}
      {command.busy && (
        <p role="status" className="text-sm">
          Đang gửi yêu cầu…</p>
      )}
      {command.error && (
        <div
          role="alert"
          className="space-y-2 rounded border border-red-200 bg-red-50 p-3 text-sm"
        >
          <p>{errorText(command.error, supportError)}</p>
        </div>
      )}
      {command.uncertain && (
        <div
          role="alert"
          className="space-y-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm"
        >
          <p>
            Chưa xác nhận được kết quả. Giữ nguyên nội dung và bấm thử lại, không tải lại trang hoặc gửi yêu cầu mới.</p>
          <Button disabled={command.busy} onClick={command.retry}>
            Kiểm tra lại bằng yêu cầu cũ
          </Button>
        </div>
      )}
    </>
  )
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hỗ trợ khách hàng</h1>
        </div>
        {role === "customer" && (
          <Button
            disabled={locked}
            onClick={() => {
              setSelected(undefined)
              setCreation({})
            }}
          >
            Tạo yêu cầu
          </Button>
        )}
      </div>
      {role !== "manager" && !selected && !creation && commandNotice}

      <Card className="space-y-3 p-4">
        <form
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault()
            change({ search: search.trim() })
          }}
        >
          <label className="block text-sm">
            Tìm tiêu đề / nội dung
            <input
              className={supportInputClass}
              maxLength={200}
              disabled={locked}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {(role !== "staff" || staffView === "assigned") && <label className="block text-sm">
            Trạng thái
            <select
              className={supportInputClass}
              disabled={locked}
              value={query.status ?? ""}
              onChange={(e) =>
                change({
                  status: (e.target.value ||
                    undefined) as SupportQuery["status"],
                })
              }
            >
              <option value="">Tất cả trạng thái</option>
              {supportStatuses.map((s) => (
                <option key={s} value={s}>
                  {copy(supportStatusLabels[s])}
                </option>
              ))}
            </select>
          </label>}
          <label className="block text-sm">
            Sắp xếp
            <select
              className={supportInputClass}
              disabled={locked}
              value={query.sort}
              onChange={(e) => change({ sort: e.target.value })}
            >
              <option value="createdAt,desc">Mới nhất</option>
              <option value="createdAt,asc">Cũ nhất</option>
              <option value="updatedAt,desc">Hồ sơ cập nhật gần nhất</option>
              <option value="subject,asc">Tiêu đề A-Z</option>
            </select>
          </label>
          <div
            className={`flex items-center gap-2 flex-wrap sm:flex-nowrap sm:col-span-2 ${
              role !== "staff" || staffView === "assigned"
                ? "lg:col-span-2"
                : "lg:col-span-3"
            }`}
          >
            <Button type="submit" disabled={locked}>
              Tìm kiếm
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={locked}
              onClick={() => {
                setSearch("")
                setQuery({ page: 0, size: role === "manager" ? 10 : 20, facilityId, sort: "createdAt,desc" })
                setQueuePage(0)
              }}
            >
              Xóa bộ lọc
            </Button>
          </div>

        </form>
      </Card>
      {role === "staff" && staffView === "queue" ? <>
        <SupportReadState {...queueRead} retry={reload} />
        {queueRead.data && <>
          {queueRead.data.data.length > 0 && <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-stone-50 text-stone-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Tiêu đề</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Cơ sở</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Tạo lúc</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {queueRead.data.data.map((item) => <tr key={item.id}>
                  <td className="max-w-sm break-words px-4 py-3 font-semibold">{item.subject}</td>
                  <td className="px-4 py-3">{actor.facilityNames?.[item.facilityId] ?? item.facilityId}</td>
                  <td className="whitespace-nowrap px-4 py-3">{rentalDate(item.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Button disabled={locked || command.conflict} onClick={async () => {
                      const succeeded = await command.run({ kind: "command", role: "staff", id: item.id,
                        command: { kind: "claim", expectedVersion: item.version } })
                      if (succeeded) { setStaffView("assigned"); setSelected(item.id) }
                    }}>Nhận xử lý</Button>
                  </td>
                </tr>)}
              </tbody>
            </table>
          </Card>}
          {queueRead.data.data.length === 0 && <Card className="p-5 text-sm">Không có yêu cầu chờ tiếp nhận</Card>}
          <ApiPager pagination={queueRead.data.pagination} disabled={locked} onPage={setQueuePage} />
        </>}
      </> : <>
      <SupportReadState {...read} retry={reload} />
      {read.data &&
        !read.data.data.every((t) => supportTicketVisible(actor, role, t)) && (
          <p
            role="alert"
            className="rounded border border-red-200 bg-red-50 p-4"
          >
            Không thể hiển thị hồ sơ ngoài phạm vi truy cập của bạn.</p>
        )}
      {read.data &&
        read.data.data.every((t) => supportTicketVisible(actor, role, t)) && (
          <>
            {read.data.data.length > 0 && <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="border-b bg-stone-50 text-stone-600">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Tiêu đề</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Trạng thái</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Mã yêu cầu</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Cơ sở</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Nhân viên phụ trách</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Tạo lúc</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {read.data.data.map((t) => <tr key={t.id}>
                    <td className="max-w-xs break-words px-4 py-3 font-semibold">{t.subject}</td>
                    <td className="px-4 py-3"><Badge variant={t.status === "closed" || t.status === "resolved" ? "success" : "warning"}>
                      {t.status === "open"
                        ? "Chờ tiếp nhận"
                        : supportStatusLabels[t.status]}
                    </Badge></td>
                    <td className="max-w-[150px] break-all px-4 py-3 text-xs text-stone-500">{t.id}</td>
                    <td className="px-4 py-3">{actor.facilityNames?.[t.facilityId ?? ""] ?? t.facilityId ?? "Chưa có thông tin"}</td>
                    <td className="px-4 py-3">{supportAssigneeLabel(t, role)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{rentalDate(t.createdAt)}</td>
                    <td className="px-4 py-3"><Button variant="outline" disabled={locked} onClick={() => {
                      setSelected(t.id)
                      command.clearError()
                    }}>Chi tiết</Button></td>
                  </tr>)}
                </tbody>
              </table>
            </Card>}
            {read.data.data.length === 0 && (
              <Card className="p-5 text-sm text-stone-500">
                Không có dữ liệu</Card>
            )}
            <ApiPager
              pagination={read.data.pagination}
              disabled={locked}
              onPage={(page) => setQuery((q) => ({ ...q, page }))}
            />
          </>
        )}
      </>}
      {selected && (
        <Modal
          open
          size="xl"
          title="Chi tiết yêu cầu Hỗ trợ"
          onClose={() => {
            if (!command.locked && !uploadLock.current) setSelected(undefined)
          }}
        >
          <div className="space-y-4">
            {commandNotice}
            <SupportTicketDetail
              key={`${identity}:${selected}:${revision}`}
              role={role}
              id={selected}
              command={formCommand}
              onUploadBusy={uploadBusy}
              onFollowUp={(parent) => {
                if (command.locked || uploadLock.current) return
                setSelected(undefined)
                setCreation({ parent })
              }}
            />
          </div>
        </Modal>
      )}
      {creation && (
        <Modal
          open
          size="lg"
          title={creation.parent ? "Yêu cầu tiếp nối" : "Tạo yêu cầu Hỗ trợ"}
          onClose={() => {
            if (!command.locked && !uploadLock.current) setCreation(undefined)
          }}
        >
          <div className="space-y-4">
            {commandNotice}
            <SupportCreateForm
              key={revision}
              command={formCommand}
              onUploadBusy={uploadBusy}
              parent={creation.parent}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
