import { useManagerPresentation } from "../manager/managerPresentation"
import { useEffect, useState } from "react"
import { Badge, Button, Card, Modal } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { useSupportCommand } from "../../hooks/useSupportCommand"
import { getAuthenticatedActor, type ApiActor } from "../../services/authApi"
import { listSupportTickets } from "../../services/supportApi"
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
import SupportStaffPicker from "./SupportStaffPicker"
import SupportTicketDetail from "./SupportTicketDetail"
import {
  canReadSupport,
  supportError,
  supportInputClass,
  supportStatusLabels,
  supportTicketVisible,
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
  const { manager, copy, errorText } = useManagerPresentation()

  const [query, setQuery] = useState<SupportQuery>({
    page: 0,
    size: 20,
    sort: "createdAt,desc",
  })
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string>()
  const [creation, setCreation] = useState<{ parent?: SupportTicket }>()
  const [revision, setRevision] = useState(0)
  const read = useRentalApiResource(
    `${identity}:${JSON.stringify(query)}`,
    () => listSupportTickets(role, query),
  )
  const command = useSupportCommand(`${actor.id}:support:${role}`, () => {
    read.refresh()
    setRevision((n) => n + 1)
    setCreation(undefined)
  })
  useEffect(() => {
    onLocked?.(command.locked)
    return () => onLocked?.(false)
  }, [command.locked, onLocked])
  const reload = () => {
    command.clearError()
    read.refresh()
    setRevision((n) => n + 1)
  }
  const change = (patch: SupportQuery) => {
    setQuery((q) => ({ ...q, ...patch, page: 0 }))
    setSelected(undefined)
  }
  const commandNotice = (
    <>
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
          {!command.locked && !manager && (
            <Button variant="outline" onClick={reload}>
              Tải lại hồ sơ trước khi thao tác tiếp
            </Button>
          )}
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
            disabled={command.locked}
            onClick={() => {
              setSelected(undefined)
              setCreation({})
            }}
          >
            Tạo yêu cầu
          </Button>
        )}
      </div>
      {!selected && !creation && commandNotice}
      <Card className="space-y-3 p-4">
        <form
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4"
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
              disabled={command.locked}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Trạng thái
            <select
              className={supportInputClass}
              disabled={command.locked}
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
          </label>
          <label className="block text-sm">
            Sắp xếp
            <select
              className={supportInputClass}
              disabled={command.locked}
              value={query.sort}
              onChange={(e) => change({ sort: e.target.value })}
            >
              <option value="createdAt,desc">Mới nhất</option>
              <option value="createdAt,asc">Cũ nhất</option>
              <option value="updatedAt,desc">Hồ sơ cập nhật gần nhất</option>
              <option value="subject,asc">Tiêu đề A-Z</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={command.locked}>
              Tìm kiếm
            </Button>
            {!manager && (<Button
              variant="outline"
              disabled={command.locked}
              onClick={reload}
            >
              Tải lại
            </Button>)}
          </div>
          {role === "manager" && (
            <label className="block text-sm">
              Cơ sở được cấp quyền
              <select
                className={supportInputClass}
                disabled={command.locked}
                value={query.facilityId ?? ""}
                onChange={(e) =>
                  change({
                    facilityId: e.target.value || undefined,
                    staffId: undefined,
                  })
                }
              >
                <option value="">Tất cả cơ sở trong phạm vi</option>
                {Object.keys(actor.facilityScopes).map((id) => (
                  <option key={id} value={id}>
                    {actor.facilityNames?.[id] ?? id}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-sm">
            Số yêu cầu / trang
            <select
              className={supportInputClass}
              disabled={command.locked}
              value={query.size}
              onChange={(e) => change({ size: Number(e.target.value) })}
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="ghost"
            disabled={command.locked}
            onClick={() => {
              setSearch("")
              setQuery({ page: 0, size: 20, sort: "createdAt,desc" })
            }}
          >
            Xóa bộ lọc
          </Button>
        </form>
        {role === "manager" &&
          query.facilityId &&
          actor.facilityScopes[query.facilityId] === "MANAGE" &&
          actor.permissions.includes("support:update") && (
            <div className="max-w-xl">
              <SupportStaffPicker
                key={query.facilityId}
                facilityId={query.facilityId}
                value={query.staffId ?? ""}
                onChange={(staffId) =>
                  change({ staffId: staffId || undefined })
                }
                disabled={command.locked}
              />
            </div>
          )}
      </Card>
      <SupportReadState {...read} retry={read.refresh} />
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
            <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
              {read.data.data.map((t) => (
                <Card key={t.id} className="min-w-0 space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="min-w-0 break-words font-semibold">
                      {t.subject}
                    </h2>
                    <Badge
                      variant={
                        t.status === "closed" || t.status === "resolved"
                          ? "success"
                          : "warning"
                      }
                    >
                      {t.status === "open"
                        ? t.assignedStaffId
                          ? "Chờ nhân viên nhận"
                          : "Chờ quản lý phân công"
                        : supportStatusLabels[t.status]}
                    </Badge>
                  </div>
                  <p className="break-all text-xs text-stone-500">Mã yêu cầu: {t.id}</p>
                  <p className="break-all text-sm">
                    Cơ sở:{" "}
                    {actor.facilityNames?.[t.facilityId ?? ""] ??
                      t.facilityId ??
                      "Chưa có thông tin"}
                  </p>
                  <p className="break-all text-sm">
                    Nhân viên phụ trách: {role === "customer" ? (t.assignedStaffId ? "Đã phân công" : "Chưa phân công") : (t.assignedStaffId ?? "Chưa phân công")}
                  </p>
                  <p className="text-sm">Tạo lúc: {rentalDate(t.createdAt)}</p>
                  <Button
                    variant="outline"
                    disabled={command.locked}
                    onClick={() => {
                      setSelected(t.id)
                      command.clearError()
                    }}
                  >
                    Chi tiết
                  </Button>
                </Card>
              ))}
            </div>
            {read.data.data.length === 0 && (
              <Card className="p-5 text-sm text-stone-500">
                Không có dữ liệu</Card>
            )}
            <ApiPager
              pagination={read.data.pagination}
              disabled={command.locked}
              onPage={(page) => setQuery((q) => ({ ...q, page }))}
            />
          </>
        )}
      {selected && (
        <Modal
          open
          size="xl"
          title="Chi tiết yêu cầu Hỗ trợ"
          onClose={() => {
            if (!command.locked) setSelected(undefined)
          }}
        >
          <div className="space-y-4">
            {commandNotice}
            <SupportTicketDetail
              key={`${identity}:${selected}:${revision}`}
              role={role}
              id={selected}
              command={command}
              onFollowUp={(parent) => {
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
            if (!command.locked) setCreation(undefined)
          }}
        >
          <div className="space-y-4">
            {commandNotice}
            <SupportCreateForm
              key={revision}
              command={command}
              parent={creation.parent}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
